namespace PhoneFarm.Application.Auth.Dtos;

public record LoginRequest(string Username, string Password);

public record UserInfoDto(int Id, string Username, string Role);

public record LoginResponse(string AccessToken, string RefreshToken, UserInfoDto User);

public record RefreshRequest(string RefreshToken);

public record RefreshResponse(string AccessToken, string RefreshToken);
