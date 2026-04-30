using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("Accounts");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Uuid)
            .IsRequired();

        builder.Property(a => a.Username)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(a => a.Password)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(a => a.DisplayName).HasMaxLength(200);
        builder.Property(a => a.Email).HasMaxLength(200);
        builder.Property(a => a.Phone).HasMaxLength(50);

        builder.Property(a => a.Status)
            .IsRequired()
            .HasMaxLength(50)
            .HasDefaultValue("active");

        builder.HasIndex(a => a.Status);

        builder.Property(a => a.Notes).HasMaxLength(1000);

        builder.Property(a => a.CreatedAt)
            .IsRequired()
            .HasColumnType("datetime2")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(a => a.UpdatedAt)
            .IsRequired()
            .HasColumnType("datetime2")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(a => a.LastLoginAt)
            .HasColumnType("datetime2");

        builder.Property(a => a.LastActivityAt)
            .HasColumnType("datetime2");

        builder.HasIndex(a => a.PlatformId);

        builder.HasOne(a => a.Platform)
            .WithMany(p => p.Accounts)
            .HasForeignKey(a => a.PlatformId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
