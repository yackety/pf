using Microsoft.EntityFrameworkCore;
using PhoneFarm.Application.Users.Dtos;
using PhoneFarm.Domain.Entities;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Users.Services;

public interface IUserService
{
    Task<IReadOnlyList<UserDto>> GetAllAsync(CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateAsync(int id, UpdateUserRequest request, CancellationToken ct = default);
}

public class UserService : IUserService
{
    private readonly PhoneFarmDbContext _db;

    public UserService(PhoneFarmDbContext db) => _db = db;

    public async Task<IReadOnlyList<UserDto>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Users
            .AsNoTracking()
            .OrderBy(u => u.Username)
            .Select(u => ToDto(u))
            .ToListAsync(ct);

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        if (!new[] { "admin", "operator" }.Contains(request.Role))
            throw new ArgumentException($"Invalid role '{request.Role}'. Must be 'admin' or 'operator'.");

        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task<UserDto> UpdateAsync(int id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users.FindAsync([id], ct)
            ?? throw new KeyNotFoundException($"User {id} not found.");

        if (request.Role is not null)
        {
            if (!new[] { "admin", "operator" }.Contains(request.Role))
                throw new ArgumentException($"Invalid role '{request.Role}'.");
            user.Role = request.Role;
        }

        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    private static UserDto ToDto(User u) =>
        new(u.Id, u.Username, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt);
}
