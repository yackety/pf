using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Infrastructure.Data.Configurations;

public class PlatformConfiguration : IEntityTypeConfiguration<Platform>
{
    public void Configure(EntityTypeBuilder<Platform> builder)
    {
        builder.ToTable("Platforms");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(p => p.Name)
            .IsUnique();

        builder.Property(p => p.DisplayName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(p => p.Url)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasData(
            new Platform { Id = 1, Name = "facebook",  DisplayName = "Facebook",  Url = "facebook.com"  },
            new Platform { Id = 2, Name = "tiktok",    DisplayName = "TikTok",    Url = "tiktok.com"    },
            new Platform { Id = 3, Name = "google",    DisplayName = "Google",    Url = "google.com"    },
            new Platform { Id = 4, Name = "youtube",   DisplayName = "YouTube",   Url = "youtube.com"   },
            new Platform { Id = 5, Name = "instagram", DisplayName = "Instagram", Url = "instagram.com" },
            new Platform { Id = 6, Name = "twitter",   DisplayName = "X (Twitter)", Url = "x.com"       }
        );
    }
}
