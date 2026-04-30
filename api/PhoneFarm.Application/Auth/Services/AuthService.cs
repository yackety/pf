using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PhoneFarm.Application.Auth.Dtos;
using PhoneFarm.Domain.Entities;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Auth.Services;

public class AuthService : IAuthService
{
    private readonly PhoneFarmDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(PhoneFarmDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive, ct)
            ?? throw new UnauthorizedAccessException("Invalid credentials.");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid credentials.");

        user.LastLoginAt = DateTime.UtcNow;

        var accessToken = GenerateAccessToken(user);
        var refreshToken = await CreateRefreshTokenAsync(user, ct);

        await _db.SaveChangesAsync(ct);

        return new LoginResponse(accessToken, refreshToken, user.Role);
    }

    public async Task<RefreshResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        var stored = await _db.UserRefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == request.RefreshToken && !t.IsRevoked, ct)
            ?? throw new UnauthorizedAccessException("Invalid refresh token.");

        if (stored.ExpiresAt < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token expired.");

        if (!stored.User.IsActive)
            throw new UnauthorizedAccessException("Account is disabled.");

        // Rotate: revoke old, issue new
        stored.IsRevoked = true;
        var newAccessToken = GenerateAccessToken(stored.User);
        var newRefreshToken = await CreateRefreshTokenAsync(stored.User, ct);

        await _db.SaveChangesAsync(ct);

        return new RefreshResponse(newAccessToken, newRefreshToken);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        var stored = await _db.UserRefreshTokens
            .FirstOrDefaultAsync(t => t.Token == refreshToken, ct);

        if (stored is not null)
        {
            stored.IsRevoked = true;
            await _db.SaveChangesAsync(ct);
        }
    }

    private string GenerateAccessToken(User user)
    {
        var jwtKey = _config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<string> CreateRefreshTokenAsync(User user, CancellationToken ct)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        _db.UserRefreshTokens.Add(new UserRefreshToken
        {
            UserId = user.Id,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
        });
        return await Task.FromResult(token);
    }
}
