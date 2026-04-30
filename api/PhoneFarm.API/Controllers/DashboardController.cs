using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.Application.Dashboard.Dtos;
using PhoneFarm.Application.Dashboard.Services;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboard;

    public DashboardController(IDashboardService dashboard) => _dashboard = dashboard;

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats(CancellationToken ct)
        => Ok(await _dashboard.GetStatsAsync(ct));
}
