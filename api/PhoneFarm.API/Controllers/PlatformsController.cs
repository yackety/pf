using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.Application.Platforms.Dtos;
using PhoneFarm.Application.Platforms.Services;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/platforms")]
[Authorize]
public class PlatformsController : ControllerBase
{
    private readonly IPlatformService _platforms;

    public PlatformsController(IPlatformService platforms) => _platforms = platforms;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlatformDto>>> GetAll(CancellationToken ct)
        => Ok(await _platforms.GetAllAsync(ct));
}
