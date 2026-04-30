using PhoneFarm.Application.Accounts.Dtos;
using PhoneFarm.Application.Common;

namespace PhoneFarm.Application.Accounts.Services;

public interface IAccountService
{
    Task<PagedResult<AccountDto>> GetAllAsync(AccountFilterQuery filter, CancellationToken ct = default);
    Task<AccountDetailDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<AccountDto> CreateAsync(CreateAccountRequest request, CancellationToken ct = default);
    Task<AccountDto> UpdateAsync(int id, UpdateAccountRequest request, CancellationToken ct = default);
    Task SoftDeleteAsync(int id, CancellationToken ct = default);
}
