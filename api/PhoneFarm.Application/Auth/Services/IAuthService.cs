using PhoneFarm.Application.Auth.Dtos;

namespace PhoneFarm.Application.Auth.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<RefreshResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default);
    Task LogoutAsync(string refreshToken, CancellationToken ct = default);
}
