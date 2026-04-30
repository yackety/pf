using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.Application.Auth.Dtos;
using PhoneFarm.Application.Auth.Services;
using System.Security.Claims;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await _auth.LoginAsync(request, ct);
        return Ok(result);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<RefreshResponse>> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var result = await _auth.RefreshAsync(request, ct);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest request, CancellationToken ct)
    {
        await _auth.LogoutAsync(request.RefreshToken, ct);
        return NoContent();
    }
}
