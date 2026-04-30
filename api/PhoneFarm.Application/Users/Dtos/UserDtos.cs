namespace PhoneFarm.Application.Users.Dtos;

public record UserDto(int Id, string Username, string Role, bool IsActive, DateTime CreatedAt, DateTime? LastLoginAt);

public record CreateUserRequest(string Username, string Password, string Role);

public record UpdateUserRequest(string? Role, bool? IsActive);
