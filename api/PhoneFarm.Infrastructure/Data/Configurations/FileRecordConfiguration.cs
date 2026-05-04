using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class FileRecordConfiguration : IEntityTypeConfiguration<FileRecord>
{
    public void Configure(EntityTypeBuilder<FileRecord> builder)
    {
        builder.ToTable("FileRecords");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.StoredName).IsRequired().HasMaxLength(300);
        builder.Property(f => f.OriginalName).IsRequired().HasMaxLength(255);
        builder.Property(f => f.FileType).IsRequired().HasMaxLength(20);
        builder.Property(f => f.SubFolder).IsRequired().HasMaxLength(50);
        builder.Property(f => f.FilePath).IsRequired().HasMaxLength(500);
        builder.Property(f => f.MimeType).HasMaxLength(100);
        builder.Property(f => f.AppName).HasMaxLength(200);
        builder.Property(f => f.Version).HasMaxLength(50);
        builder.Property(f => f.PackageName).HasMaxLength(200);
        builder.Property(f => f.Description).HasMaxLength(500);
        builder.Property(f => f.RequiresAndroid).HasMaxLength(100);
        builder.Property(f => f.Signature).HasMaxLength(100);
        builder.Property(f => f.Architectures).HasMaxLength(200);

        builder.Property(f => f.FileSize).IsRequired();
        builder.Property(f => f.UploadedAt).IsRequired().HasColumnType("datetime2");

        builder.HasIndex(f => f.FileType);
        builder.HasIndex(f => f.AgentId);

        builder.HasOne(f => f.Agent)
            .WithMany()
            .HasForeignKey(f => f.AgentId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(f => f.UploadedBy)
            .WithMany()
            .HasForeignKey(f => f.UploadedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
