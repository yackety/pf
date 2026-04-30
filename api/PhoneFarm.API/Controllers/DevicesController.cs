using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.API.Services;
using PhoneFarm.Application.Common;
using PhoneFarm.Application.Devices.Dtos;
using PhoneFarm.Application.Devices.Services;
using System.Security.Claims;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/devices")]
[Authorize]
public class DevicesController : ControllerBase
{
    private readonly IDeviceService _devices;
    private readonly IAgentProxyService _proxy;

    public DevicesController(IDeviceService devices, IAgentProxyService proxy)
    {
        _devices = devices;
        _proxy = proxy;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<DeviceDto>>> GetAll(
        [FromQuery] string? state,
        [FromQuery] string? platform,
        [FromQuery] int? agentId,
        [FromQuery] string? tag,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var filter = new DeviceFilterQuery
        {
            State = state,
            Platform = platform,
            AgentId = agentId,
            Tag = tag,
            Search = search,
            Page = page,
            PageSize = pageSize,
        };
        var result = await _devices.GetAllAsync(filter, ct);
        return Ok(result);
    }

    [HttpGet("{udid}")]
    public async Task<ActionResult<DeviceDto>> GetByUdid(string udid, CancellationToken ct)
    {
        var result = await _devices.GetByUdidAsync(udid, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPatch("{udid}")]
    public async Task<ActionResult<DeviceDto>> Patch(string udid, [FromBody] UpdateDeviceRequest request, CancellationToken ct)
    {
        var result = await _devices.UpdateMetaAsync(udid, request, ct);
        return Ok(result);
    }

    [HttpGet("{udid}/log")]
    public async Task<ActionResult<PagedResult<SessionLogDto>>> GetLog(
        string udid,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var result = await _devices.GetSessionLogAsync(udid, new PaginationQuery { Page = page, PageSize = pageSize }, ct);
        return Ok(result);
    }

    [HttpGet("{udid}/accounts")]
    public async Task<ActionResult<IReadOnlyList<DeviceAccountDto>>> GetLinkedAccounts(string udid, CancellationToken ct)
        => Ok(await _devices.GetLinkedAccountsAsync(udid, ct));

    [HttpPost("{udid}/accounts/{accountId:int}")]
    public async Task<ActionResult<DeviceAccountDto>> LinkAccount(string udid, int accountId, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var result = await _devices.LinkAccountAsync(udid, accountId, userId, ct);
        return Ok(result);
    }

    [HttpDelete("{udid}/accounts/{accountId:int}")]
    public async Task<IActionResult> UnlinkAccount(string udid, int accountId, CancellationToken ct)
    {
        await _devices.UnlinkAccountAsync(udid, accountId, ct);
        return NoContent();
    }

    [HttpPost("{udid}/action")]
    public async Task<IActionResult> ProxyAction(string udid, [FromBody] DeviceActionRequest request, CancellationToken ct)
    {
        var upstream = await _proxy.ForwardActionAsync(udid, request, ct);
        var content = await upstream.Content.ReadAsStringAsync(ct);
        return StatusCode((int)upstream.StatusCode, content);
    }
}
