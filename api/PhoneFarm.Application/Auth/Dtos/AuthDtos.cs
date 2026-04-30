namespace PhoneFarm.Application.Auth.Dtos;

public record LoginRequest(string Username, string Password);

public record LoginResponse(string AccessToken, string RefreshToken, string Role);

public record RefreshRequest(string RefreshToken);

public record RefreshResponse(string AccessToken, string RefreshToken);
