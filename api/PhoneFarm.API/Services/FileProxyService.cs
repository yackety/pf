using Microsoft.EntityFrameworkCore;
using PhoneFarm.Infrastructure.Data;
using System.Net.Http.Json;

namespace PhoneFarm.API.Services;

public record AgentUploadResult(string StoredName, string SubFolder, string FilePath, long FileSize);

public interface IFileProxyService
{
    Task<AgentUploadResult> UploadFileAsync(int? agentId, IFormFile file, CancellationToken ct = default);
    Task DeleteFileAsync(string agentHost, string filePath, CancellationToken ct = default);
    Task<object> InstallFileAsync(string agentHost, string filePath, string[] udids, CancellationToken ct = default);
}

public class FileProxyService : IFileProxyService
{
    private readonly PhoneFarmDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public FileProxyService(PhoneFarmDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    private string GetAgentHost(string host) => host.TrimEnd('/');

    /// <summary>Resolves the first online agent host. If agentId provided, uses that specific agent.</summary>
    private async Task<string> ResolveAgentHostAsync(int? agentId, CancellationToken ct)
    {
        if (agentId.HasValue)
        {
            var agent = await _db.Agents.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == agentId.Value, ct)
                ?? throw new KeyNotFoundException($"Agent {agentId} not found.");
            if (!agent.IsOnline) throw new AgentProxyException($"Agent {agentId} is offline.", 503);
            return agent.Host;
        }

        // Pick any online agent
        var any = await _db.Agents.AsNoTracking()
            .Where(a => a.IsOnline)
            .OrderByDescending(a => a.LastHeartbeatAt)
            .FirstOrDefaultAsync(ct)
            ?? throw new AgentProxyException("No online agents available.", 503);

        return any.Host;
    }

    public async Task<AgentUploadResult> UploadFileAsync(int? agentId, IFormFile file, CancellationToken ct = default)
    {
        var host = GetAgentHost(await ResolveAgentHostAsync(agentId, ct));
        var client = _httpClientFactory.CreateClient("AgentProxy");
        client.Timeout = TimeSpan.FromMinutes(5); // large files

        using var content = new StreamContent(file.OpenReadStream());
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
            string.IsNullOrEmpty(file.ContentType) ? "application/octet-stream" : file.ContentType);

        var request = new HttpRequestMessage(HttpMethod.Post, $"{host}/api/files/upload")
        {
            Content = content
        };
        request.Headers.TryAddWithoutValidation("X-Filename", file.FileName);
        request.Headers.TryAddWithoutValidation("X-File-Size", file.Length.ToString());

        var response = await client.SendAsync(request, ct);

        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(ct);
            throw new AgentProxyException($"Agent upload failed ({(int)response.StatusCode}): {err}");
        }

        var result = await response.Content.ReadFromJsonAsync<AgentUploadResponse>(ct)
            ?? throw new AgentProxyException("Invalid response from agent.");

        return new AgentUploadResult(result.StoredName, result.SubFolder, result.FilePath, result.FileSize);
    }

    public async Task DeleteFileAsync(string agentHost, string filePath, CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("AgentProxy");
        var request = new HttpRequestMessage(HttpMethod.Delete, $"{GetAgentHost(agentHost)}/api/files")
        {
            Content = JsonContent.Create(new { filePath })
        };
        // Best-effort — ignore failure
        try { await client.SendAsync(request, ct); } catch { /* agent may be offline */ }
    }

    public async Task<object> InstallFileAsync(string agentHost, string filePath, string[] udids, CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient("AgentProxy");
        var payload = new { udids, filePath };
        var response = await client.PostAsJsonAsync($"{GetAgentHost(agentHost)}/api/goog/device/install-bulk", payload, ct);
        var json = await response.Content.ReadFromJsonAsync<object>(ct) ?? new { success = false };
        return json;
    }

    private sealed record AgentUploadResponse(bool Success, string StoredName, string SubFolder, string FilePath, long FileSize);
}
