using Microsoft.EntityFrameworkCore;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.API.Services;

public class AgentProxyException : Exception
{
    public int StatusCode { get; }
    public AgentProxyException(string message, int statusCode = 502) : base(message)
        => StatusCode = statusCode;
}

public interface IAgentProxyService
{
    Task<HttpResponseMessage> ForwardActionAsync(string udid, object payload, CancellationToken ct = default);
}

public class AgentProxyService : IAgentProxyService
{
    private readonly PhoneFarmDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public AgentProxyService(PhoneFarmDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<HttpResponseMessage> ForwardActionAsync(string udid, object payload, CancellationToken ct = default)
    {
        var device = await _db.Devices
            .AsNoTracking()
            .Include(d => d.Agent)
            .FirstOrDefaultAsync(d => d.Udid == udid, ct)
            ?? throw new KeyNotFoundException($"Device '{udid}' not found.");

        var agent = device.Agent
            ?? throw new AgentProxyException($"Device '{udid}' has no assigned agent.", 503);

        if (!agent.IsOnline)
            throw new AgentProxyException($"Agent '{agent.AgentId}' is offline.", 503);

        var url = $"{agent.Host.TrimEnd('/')}/api/devices/{udid}/action";

        var client = _httpClientFactory.CreateClient("AgentProxy");
        var response = await client.PostAsJsonAsync(url, payload, ct);

        return response;
    }
}
