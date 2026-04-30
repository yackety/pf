using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class DeviceConfiguration : IEntityTypeConfiguration<Device>
{
    public void Configure(EntityTypeBuilder<Device> builder)
    {
        builder.ToTable("Devices");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Udid)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasIndex(d => d.Udid)
            .IsUnique();

        builder.Property(d => d.Platform)
            .IsRequired()
            .HasMaxLength(10);

        builder.Property(d => d.State)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(d => d.State);

        builder.HasIndex(d => d.AgentId);

        builder.Property(d => d.Manufacturer).HasMaxLength(100);
        builder.Property(d => d.Model).HasMaxLength(100);
        builder.Property(d => d.OsVersion).HasMaxLength(50);
        builder.Property(d => d.SdkVersion).HasMaxLength(20);
        builder.Property(d => d.CpuAbi).HasMaxLength(50);
        builder.Property(d => d.WifiInterface).HasMaxLength(50);
        builder.Property(d => d.IpAddresses).HasMaxLength(1000);
        builder.Property(d => d.DeviceName).HasMaxLength(100);
        builder.Property(d => d.RawProps).HasMaxLength(1000);
        builder.Property(d => d.Tags).HasMaxLength(500);
        builder.Property(d => d.Notes).HasMaxLength(1000);

        builder.Property(d => d.FirstSeenAt)
            .IsRequired()
            .HasColumnType("datetime2");

        builder.Property(d => d.LastSeenAt)
            .IsRequired()
            .HasColumnType("datetime2");

        builder.Property(d => d.LastStateChangeAt)
            .HasColumnType("datetime2");

        builder.HasOne(d => d.Agent)
            .WithMany(a => a.Devices)
            .HasForeignKey(d => d.AgentId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
