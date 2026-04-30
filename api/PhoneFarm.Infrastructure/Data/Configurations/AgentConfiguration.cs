using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class AgentConfiguration : IEntityTypeConfiguration<Agent>
{
    public void Configure(EntityTypeBuilder<Agent> builder)
    {
        builder.ToTable("Agents");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.AgentId)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasIndex(a => a.AgentId)
            .IsUnique();

        builder.Property(a => a.Host)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(a => a.LastHeartbeatAt)
            .HasColumnType("datetime2");

        builder.Property(a => a.IsOnline)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(a => a.RegisteredAt)
            .IsRequired()
            .HasColumnType("datetime2")
            .HasDefaultValueSql("GETUTCDATE()");
    }
}
