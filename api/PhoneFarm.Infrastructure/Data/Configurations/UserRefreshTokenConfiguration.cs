using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class UserRefreshTokenConfiguration : IEntityTypeConfiguration<UserRefreshToken>
{
    public void Configure(EntityTypeBuilder<UserRefreshToken> builder)
    {
        builder.ToTable("UserRefreshTokens");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Token)
            .IsRequired()
            .HasMaxLength(512);

        builder.HasIndex(t => t.Token)
            .IsUnique();

        builder.Property(t => t.ExpiresAt)
            .IsRequired()
            .HasColumnType("datetime2");

        builder.Property(t => t.CreatedAt)
            .IsRequired()
            .HasColumnType("datetime2")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(t => t.IsRevoked)
            .IsRequired()
            .HasDefaultValue(false);

        builder.HasIndex(t => new { t.UserId, t.IsRevoked });

        builder.HasOne(t => t.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
