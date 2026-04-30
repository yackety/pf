using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.Application.Users.Dtos;
using PhoneFarm.Application.Users.Services;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "admin")]
public class UsersController : ControllerBase
{
    private readonly IUserService _users;

    public UsersController(IUserService users) => _users = users;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetAll(CancellationToken ct)
        => Ok(await _users.GetAllAsync(ct));

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        var result = await _users.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetAll), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserDto>> Update(int id, [FromBody] UpdateUserRequest request, CancellationToken ct)
        => Ok(await _users.UpdateAsync(id, request, ct));
}
