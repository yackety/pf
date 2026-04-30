using Microsoft.EntityFrameworkCore;
using PhoneFarm.Application.Agents.Dtos;
using PhoneFarm.Application.Common;
using PhoneFarm.Application.Devices.Dtos;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Agents.Services;

public class AgentService : IAgentService
{
    private readonly PhoneFarmDbContext _db;

    public AgentService(PhoneFarmDbContext db) => _db = db;

    public async Task<IReadOnlyList<AgentDto>> GetAllAsync(CancellationToken ct = default)
    {
        return await _db.Agents
            .AsNoTracking()
            .Select(a => new AgentDto(
                a.Id,
                a.AgentId,
                a.Host,
                a.IsOnline,
                a.LastHeartbeatAt,
                a.RegisteredAt,
                a.Devices.Count))
            .OrderBy(a => a.AgentId)
            .ToListAsync(ct);
    }

    public async Task<AgentDetailDto?> GetByAgentIdAsync(string agentId, CancellationToken ct = default)
    {
        return await _db.Agents
            .AsNoTracking()
            .Where(a => a.AgentId == agentId)
            .Select(a => new AgentDetailDto(
                a.Id,
                a.AgentId,
                a.Host,
                a.IsOnline,
                a.LastHeartbeatAt,
                a.RegisteredAt))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<PagedResult<DeviceDto>> GetDevicesAsync(string agentId, PaginationQuery pagination, CancellationToken ct = default)
    {
        var agent = await _db.Agents.AsNoTracking().FirstOrDefaultAsync(a => a.AgentId == agentId, ct);
        if (agent is null)
            return PagedResult<DeviceDto>.From([], 0, pagination.Page, pagination.PageSize);

        var query = _db.Devices.AsNoTracking().Where(d => d.AgentId == agent.Id);
        var total = await query.CountAsync(ct);

        var data = await query
            .OrderByDescending(d => d.LastSeenAt)
            .Skip(pagination.Skip)
            .Take(pagination.PageSize)
            .Select(d => DeviceDto.FromEntity(d))
            .ToListAsync(ct);

        return PagedResult<DeviceDto>.From(data, total, pagination.Page, pagination.PageSize);
    }
}
