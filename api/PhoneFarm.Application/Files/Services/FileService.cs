using Microsoft.EntityFrameworkCore;
using PhoneFarm.Application.Common;
using PhoneFarm.Application.Files.Dtos;
using PhoneFarm.Domain.Entities;
using PhoneFarm.Infrastructure.Data;

namespace PhoneFarm.Application.Files.Services;

public interface IFileService
{
    Task<PagedResult<FileRecordDto>> GetAllAsync(FileRecordFilterQuery filter, CancellationToken ct = default);
    Task<FileRecordDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<FileRecordDto> CreateAsync(CreateFileRecordRequest request, int? uploadedById, CancellationToken ct = default);
    Task<FileRecordDto> UpdateAsync(int id, UpdateFileRecordRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
    Task<(int AgentId, string Host, string FilePath)?> GetInstallInfoAsync(int id, CancellationToken ct = default);
}

public class FileService : IFileService
{
    private readonly PhoneFarmDbContext _db;

    public FileService(PhoneFarmDbContext db) => _db = db;

    public async Task<PagedResult<FileRecordDto>> GetAllAsync(FileRecordFilterQuery filter, CancellationToken ct = default)
    {
        var query = _db.FileRecords
            .AsNoTracking()
            .Include(f => f.UploadedBy);

        var filtered = query.AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.FileType))
            filtered = filtered.Where(f => f.FileType == filter.FileType);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search;
            filtered = filtered.Where(f =>
                f.OriginalName.Contains(s) ||
                (f.AppName != null && f.AppName.Contains(s)) ||
                (f.PackageName != null && f.PackageName.Contains(s)) ||
                (f.Version != null && f.Version.Contains(s)) ||
                (f.Description != null && f.Description.Contains(s)));
        }

        var total = await filtered.CountAsync(ct);
        var data = await filtered
            .OrderByDescending(f => f.UploadedAt)
            .Skip(filter.Skip)
            .Take(filter.PageSize)
            .Select(f => FileRecordDto.FromEntity(f))
            .ToListAsync(ct);

        return PagedResult<FileRecordDto>.From(data, total, filter.Page, filter.PageSize);
    }

    public async Task<FileRecordDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var f = await _db.FileRecords.AsNoTracking()
            .Include(x => x.UploadedBy)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return f is null ? null : FileRecordDto.FromEntity(f);
    }

    public async Task<FileRecordDto> CreateAsync(CreateFileRecordRequest request, int? uploadedById, CancellationToken ct = default)
    {
        var entity = new FileRecord
        {
            AgentId = request.AgentId,
            UploadedById = uploadedById,
            StoredName = request.StoredName,
            OriginalName = request.OriginalName,
            FileType = request.FileType,
            SubFolder = request.SubFolder,
            FilePath = request.FilePath,
            MimeType = request.MimeType,
            FileSize = request.FileSize,
            AppName = request.AppName,
            Version = request.Version,
            PackageName = request.PackageName,
            Description = request.Description,
            RequiresAndroid = request.RequiresAndroid,
            PermissionsCount = request.PermissionsCount,
            Signature = request.Signature,
            Architectures = request.Architectures,
            UploadedAt = DateTime.UtcNow,
        };
        _db.FileRecords.Add(entity);
        await _db.SaveChangesAsync(ct);
        return FileRecordDto.FromEntity(entity);
    }

    public async Task<FileRecordDto> UpdateAsync(int id, UpdateFileRecordRequest request, CancellationToken ct = default)
    {
        var entity = await _db.FileRecords.FindAsync([id], ct)
            ?? throw new KeyNotFoundException($"FileRecord {id} not found.");

        if (request.AppName is not null) entity.AppName = request.AppName;
        if (request.Version is not null) entity.Version = request.Version;
        if (request.PackageName is not null) entity.PackageName = request.PackageName;
        if (request.Description is not null) entity.Description = request.Description;
        if (request.RequiresAndroid is not null) entity.RequiresAndroid = request.RequiresAndroid;
        if (request.PermissionsCount is not null) entity.PermissionsCount = request.PermissionsCount;
        if (request.Signature is not null) entity.Signature = request.Signature;
        if (request.Architectures is not null) entity.Architectures = request.Architectures;

        await _db.SaveChangesAsync(ct);
        return FileRecordDto.FromEntity(entity);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.FileRecords.FindAsync([id], ct)
            ?? throw new KeyNotFoundException($"FileRecord {id} not found.");
        _db.FileRecords.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<(int AgentId, string Host, string FilePath)?> GetInstallInfoAsync(int id, CancellationToken ct = default)
    {
        var f = await _db.FileRecords.AsNoTracking()
            .Include(x => x.Agent)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (f?.Agent is null) return null;
        return (f.Agent.Id, f.Agent.Host, f.FilePath);
    }
}
