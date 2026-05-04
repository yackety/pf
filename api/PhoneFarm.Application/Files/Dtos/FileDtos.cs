using PhoneFarm.Domain.Entities;

namespace PhoneFarm.Application.Files.Dtos;

public record FileRecordDto(
    int Id,
    int? AgentId,
    string StoredName,
    string OriginalName,
    string FileType,
    string SubFolder,
    string FilePath,
    string? MimeType,
    long FileSize,
    string? AppName,
    string? Version,
    string? PackageName,
    string? Description,
    string? RequiresAndroid,
    int? PermissionsCount,
    string? Signature,
    string? Architectures,
    DateTime UploadedAt,
    string? UploadedByUsername)
{
    public static FileRecordDto FromEntity(FileRecord f) => new(
        f.Id, f.AgentId,
        f.StoredName, f.OriginalName, f.FileType, f.SubFolder, f.FilePath,
        f.MimeType, f.FileSize,
        f.AppName, f.Version, f.PackageName, f.Description,
        f.RequiresAndroid, f.PermissionsCount, f.Signature, f.Architectures,
        f.UploadedAt, f.UploadedBy?.Username);
}

public record CreateFileRecordRequest(
    int? AgentId,
    string StoredName,
    string OriginalName,
    string FileType,
    string SubFolder,
    string FilePath,
    string? MimeType,
    long FileSize,
    string? AppName,
    string? Version,
    string? PackageName,
    string? Description,
    string? RequiresAndroid,
    int? PermissionsCount,
    string? Signature,
    string? Architectures);

public record UpdateFileRecordRequest(
    string? AppName,
    string? Version,
    string? PackageName,
    string? Description,
    string? RequiresAndroid,
    int? PermissionsCount,
    string? Signature,
    string? Architectures);

public class FileRecordFilterQuery
{
    public string? FileType { get; init; }
    public string? Search { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
    public int Skip => (Page - 1) * PageSize;
}
