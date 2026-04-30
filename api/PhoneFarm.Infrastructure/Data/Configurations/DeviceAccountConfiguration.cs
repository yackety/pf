using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class DeviceAccountConfiguration : IEntityTypeConfiguration<DeviceAccount>
{
    public void Configure(EntityTypeBuilder<DeviceAccount> builder)
    {
        builder.ToTable("DeviceAccounts");

        builder.HasKey(da => da.Id);

        builder.Property(da => da.AssignedAt)
            .IsRequired()
            .HasColumnType("datetime2")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(da => da.UnassignedAt)
            .HasColumnType("datetime2");

        builder.Property(da => da.Notes).HasMaxLength(1000);

        // Active assignments query index
        builder.HasIndex(da => new { da.DeviceId, da.AccountId, da.UnassignedAt });

        builder.HasOne(da => da.Device)
            .WithMany(d => d.DeviceAccounts)
            .HasForeignKey(da => da.DeviceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(da => da.Account)
            .WithMany(a => a.DeviceAccounts)
            .HasForeignKey(da => da.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(da => da.AssignedByUser)
            .WithMany(u => u.DeviceAccountAssignments)
            .HasForeignKey(da => da.AssignedBy)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
