using Microsoft.EntityFrameworkCore;
using PhoneFarm.Application.Accounts.Dtos;
using PhoneFarm.Application.Common;
using PhoneFarm.Domain.Entities;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Accounts.Services;

public class AccountService : IAccountService
{
    private readonly PhoneFarmDbContext _db;

    public AccountService(PhoneFarmDbContext db) => _db = db;

    public async Task<PagedResult<AccountDto>> GetAllAsync(AccountFilterQuery filter, CancellationToken ct = default)
    {
        IQueryable<Account> query = _db.Accounts.AsNoTracking().Include(a => a.Platform);

        if (filter.PlatformId.HasValue)
            query = query.Where(a => a.PlatformId == filter.PlatformId.Value);

        if (!string.IsNullOrWhiteSpace(filter.Status))
            query = query.Where(a => a.Status == filter.Status);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search;
            query = query.Where(a =>
                a.Username.Contains(s) ||
                (a.DisplayName != null && a.DisplayName.Contains(s)) ||
                (a.Email != null && a.Email.Contains(s)));
        }

        var total = await query.CountAsync(ct);
        var data = await query
            .OrderBy(a => a.Username)
            .Skip(filter.Skip)
            .Take(filter.PageSize)
            .Select(a => ToDto(a))
            .ToListAsync(ct);

        return PagedResult<AccountDto>.From(data, total, filter.Page, filter.PageSize);
    }

    public async Task<AccountDetailDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var account = await _db.Accounts
            .AsNoTracking()
            .Include(a => a.Platform)
            .Include(a => a.DeviceAccounts.Where(da => da.UnassignedAt == null))
                .ThenInclude(da => da.Device)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        if (account is null) return null;

        var linked = account.DeviceAccounts
            .Select(da => new LinkedDeviceDto(
                da.Device.Id, da.Device.Udid, da.Device.Platform,
                da.Device.Model, da.AssignedAt))
            .ToList();

        return new AccountDetailDto(
            account.Id, account.PlatformId, account.Platform.DisplayName,
            account.Uuid, account.Username, account.DisplayName,
            account.Email, account.Phone, account.Status, account.Notes,
            account.CreatedAt, account.UpdatedAt, account.LastLoginAt, account.LastActivityAt,
            linked);
    }

    public async Task<AccountDto> CreateAsync(CreateAccountRequest request, CancellationToken ct = default)
    {
        var platform = await _db.Platforms.FindAsync([request.PlatformId], ct)
            ?? throw new KeyNotFoundException($"Platform {request.PlatformId} not found.");

        var account = new Account
        {
            PlatformId = request.PlatformId,
            Uuid = Guid.NewGuid(),
            Username = request.Username,
            Password = request.Password,
            DisplayName = request.DisplayName,
            Email = request.Email,
            Phone = request.Phone,
            Notes = request.Notes,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.Accounts.Add(account);
        await _db.SaveChangesAsync(ct);
        account.Platform = platform;
        return ToDto(account);
    }

    public async Task<AccountDto> UpdateAsync(int id, UpdateAccountRequest request, CancellationToken ct = default)
    {
        var account = await _db.Accounts.Include(a => a.Platform)
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new KeyNotFoundException($"Account {id} not found.");

        if (request.Username is not null) account.Username = request.Username;
        if (request.Password is not null) account.Password = request.Password;
        if (request.DisplayName is not null) account.DisplayName = request.DisplayName;
        if (request.Email is not null) account.Email = request.Email;
        if (request.Phone is not null) account.Phone = request.Phone;
        if (request.Notes is not null) account.Notes = request.Notes;
        if (request.Status is not null) account.Status = request.Status;
        account.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ToDto(account);
    }

    public async Task SoftDeleteAsync(int id, CancellationToken ct = default)
    {
        var account = await _db.Accounts.FindAsync([id], ct)
            ?? throw new KeyNotFoundException($"Account {id} not found.");

        account.Status = "inactive";
        account.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private static AccountDto ToDto(Account a) => new(
        a.Id, a.PlatformId, a.Platform.DisplayName,
        a.Uuid, a.Username, a.DisplayName,
        a.Email, a.Phone, a.Status, a.Notes,
        a.CreatedAt, a.UpdatedAt, a.LastLoginAt, a.LastActivityAt);
}
