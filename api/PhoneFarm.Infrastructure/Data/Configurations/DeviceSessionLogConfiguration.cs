using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class DeviceSessionLogConfiguration : IEntityTypeConfiguration<DeviceSessionLog>
{
    public void Configure(EntityTypeBuilder<DeviceSessionLog> builder)
    {
        builder.ToTable("DeviceSessionLog");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseIdentityColumn();

        builder.Property(l => l.Event)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(l => l.OldState).HasMaxLength(50);
        builder.Property(l => l.NewState).HasMaxLength(50);

        builder.Property(l => l.OccurredAt)
            .IsRequired()
            .HasColumnType("datetime2")
            .HasDefaultValueSql("GETUTCDATE()");

        // Query index: history for a specific device (descending for pagination)
        builder.HasIndex(l => new { l.DeviceId, l.OccurredAt });

        builder.HasOne(l => l.Device)
            .WithMany(d => d.SessionLogs)
            .HasForeignKey(l => l.DeviceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Agent)
            .WithMany(a => a.SessionLogs)
            .HasForeignKey(l => l.AgentId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
