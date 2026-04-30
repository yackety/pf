using PhoneFarm.Application.Agents.Dtos;
using PhoneFarm.Application.Common;
using PhoneFarm.Application.Devices.Dtos;

namespace PhoneFarm.Application.Agents.Services;

public interface IAgentService
{
    Task<IReadOnlyList<AgentDto>> GetAllAsync(CancellationToken ct = default);
    Task<AgentDetailDto?> GetByAgentIdAsync(string agentId, CancellationToken ct = default);
    Task<PagedResult<DeviceDto>> GetDevicesAsync(string agentId, PaginationQuery pagination, CancellationToken ct = default);
}
