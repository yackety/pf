using Microsoft.EntityFrameworkCore;
using PhoneFarm.Domain.Entities;
using PhoneFarm.Infrastructure.Data.Configurations;

namespace PhoneFarm.Infrastructure.Data;

public class PhoneFarmDbContext : DbContext
{
    public PhoneFarmDbContext(DbContextOptions<PhoneFarmDbContext> options) : base(options) { }

    public DbSet<Agent> Agents => Set<Agent>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Platform> Platforms => Set<Platform>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<DeviceAccount> DeviceAccounts => Set<DeviceAccount>();
    public DbSet<User> Users => Set<User>();
    public DbSet<DeviceSessionLog> DeviceSessionLogs => Set<DeviceSessionLog>();
    public DbSet<UserRefreshToken> UserRefreshTokens => Set<UserRefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new AgentConfiguration());
        modelBuilder.ApplyConfiguration(new DeviceConfiguration());
        modelBuilder.ApplyConfiguration(new PlatformConfiguration());
        modelBuilder.ApplyConfiguration(new AccountConfiguration());
        modelBuilder.ApplyConfiguration(new DeviceAccountConfiguration());
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new DeviceSessionLogConfiguration());
        modelBuilder.ApplyConfiguration(new UserRefreshTokenConfiguration());
    }
}
