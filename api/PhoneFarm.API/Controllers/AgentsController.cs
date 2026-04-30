using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.Application.Agents.Dtos;
using PhoneFarm.Application.Agents.Services;
using PhoneFarm.Application.Common;
using PhoneFarm.Application.Devices.Dtos;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/agents")]
[Authorize]
public class AgentsController : ControllerBase
{
    private readonly IAgentService _agents;

    public AgentsController(IAgentService agents) => _agents = agents;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AgentDto>>> GetAll(CancellationToken ct)
    {
        var result = await _agents.GetAllAsync(ct);
        return Ok(result);
    }

    [HttpGet("{agentId}")]
    public async Task<ActionResult<AgentDetailDto>> GetById(string agentId, CancellationToken ct)
    {
        var result = await _agents.GetByAgentIdAsync(agentId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("{agentId}/devices")]
    public async Task<ActionResult<PagedResult<DeviceDto>>> GetDevices(
        string agentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var result = await _agents.GetDevicesAsync(agentId, new PaginationQuery { Page = page, PageSize = pageSize }, ct);
        return Ok(result);
    }
}
