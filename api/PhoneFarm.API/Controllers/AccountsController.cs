using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.Application.Accounts.Dtos;
using PhoneFarm.Application.Accounts.Services;
using PhoneFarm.Application.Common;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/accounts")]
[Authorize]
public class AccountsController : ControllerBase
{
    private readonly IAccountService _accounts;

    public AccountsController(IAccountService accounts) => _accounts = accounts;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AccountDto>>> GetAll(
        [FromQuery] int? platformId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var filter = new AccountFilterQuery
        {
            PlatformId = platformId,
            Status = status,
            Search = search,
            Page = page,
            PageSize = pageSize,
        };
        return Ok(await _accounts.GetAllAsync(filter, ct));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AccountDetailDto>> GetById(int id, CancellationToken ct)
    {
        var result = await _accounts.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<AccountDto>> Create([FromBody] CreateAccountRequest request, CancellationToken ct)
    {
        var result = await _accounts.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AccountDto>> Update(int id, [FromBody] UpdateAccountRequest request, CancellationToken ct)
        => Ok(await _accounts.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SoftDelete(int id, CancellationToken ct)
    {
        await _accounts.SoftDeleteAsync(id, ct);
        return NoContent();
    }
}
