using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PhoneFarm.Infrastructure.Data;

/// <summary>
/// Used by `dotnet ef migrations add` at design time.
/// Connection string is only needed to resolve provider metadata; it does not connect to a live DB.
/// </summary>
public class PhoneFarmDbContextFactory : IDesignTimeDbContextFactory<PhoneFarmDbContext>
{
    public PhoneFarmDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PhoneFarmDbContext>()
            .UseSqlServer("Server=localhost;Database=PhoneFarm;Integrated Security=true;TrustServerCertificate=true;")
            .Options;

        return new PhoneFarmDbContext(options);
    }
}
