namespace PhoneFarm.Application.Dashboard.Dtos;

public record DashboardStatsDto(
    int TotalDevices,
    int OnlineDevices,
    int OfflineDevices,
    int TotalAgents,
    int OnlineAgents,
    int TotalAccounts,
    IReadOnlyList<PlatformAccountCount> AccountsPerPlatform);

public record PlatformAccountCount(string PlatformName, int Total, int Active);
