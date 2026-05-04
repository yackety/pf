namespace PhoneFarm.Domain.Entities;

public class FileRecord
{
    public int Id { get; set; }
    public int? AgentId { get; set; }
    public int? UploadedById { get; set; }

    /// <summary>Timestamped unique filename stored on the agent disk.</summary>
    public string StoredName { get; set; } = string.Empty;

    /// <summary>Original filename as provided by the uploader.</summary>
    public string OriginalName { get; set; } = string.Empty;

    /// <summary>Category bucket: apk | images | videos | other</summary>
    public string FileType { get; set; } = string.Empty;

    /// <summary>Subfolder inside uploads/: apk | images | videos | other</summary>
    public string SubFolder { get; set; } = string.Empty;

    /// <summary>Absolute path on the agent machine.</summary>
    public string FilePath { get; set; } = string.Empty;

    public string? MimeType { get; set; }
    public long FileSize { get; set; }

    // User-supplied metadata
    public string? AppName { get; set; }
    public string? Version { get; set; }
    public string? PackageName { get; set; }
    public string? Description { get; set; }

    // APK-specific metadata
    public string? RequiresAndroid { get; set; }
    public int? PermissionsCount { get; set; }
    public string? Signature { get; set; }
    public string? Architectures { get; set; }

    public DateTime UploadedAt { get; set; }

    public Agent? Agent { get; set; }
    public User? UploadedBy { get; set; }
}
