using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PhoneFarm.API.Services;
using PhoneFarm.Application.Common;
using PhoneFarm.Application.Files.Dtos;
using PhoneFarm.Application.Files.Services;
using System.Security.Claims;

namespace PhoneFarm.API.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly IFileService _files;
    private readonly IFileProxyService _fileProxy;

    public FilesController(IFileService files, IFileProxyService fileProxy)
    {
        _files = files;
        _fileProxy = fileProxy;
    }

    // GET /api/files
    [HttpGet]
    public async Task<ActionResult<PagedResult<FileRecordDto>>> GetAll(
        [FromQuery] string? fileType,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var result = await _files.GetAllAsync(new FileRecordFilterQuery
        {
            FileType = fileType,
            Search = search,
            Page = page,
            PageSize = pageSize,
        }, ct);
        return Ok(result);
    }

    // GET /api/files/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<FileRecordDto>> GetOne(int id, CancellationToken ct)
    {
        var result = await _files.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    // POST /api/files — multipart/form-data: file + metadata fields
    [HttpPost]
    [RequestSizeLimit(524_288_000)] // 500 MB
    public async Task<ActionResult<FileRecordDto>> Upload(
        IFormFile file,
        [FromForm] int? agentId,
        [FromForm] string? appName,
        [FromForm] string? version,
        [FromForm] string? packageName,
        [FromForm] string? description,
        [FromForm] string? requiresAndroid,
        [FromForm] int? permissionsCount,
        [FromForm] string? signature,
        [FromForm] string? architectures,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        // Forward binary to agent
        var uploadResult = await _fileProxy.UploadFileAsync(agentId, file, ct);

        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? (int?)uid : null;

        var dto = await _files.CreateAsync(new CreateFileRecordRequest(
            AgentId: agentId,
            StoredName: uploadResult.StoredName,
            OriginalName: file.FileName,
            FileType: uploadResult.SubFolder,
            SubFolder: uploadResult.SubFolder,
            FilePath: uploadResult.FilePath,
            MimeType: file.ContentType,
            FileSize: uploadResult.FileSize,
            AppName: appName,
            Version: version,
            PackageName: packageName,
            Description: description,
            RequiresAndroid: requiresAndroid,
            PermissionsCount: permissionsCount,
            Signature: signature,
            Architectures: architectures),
            userId, ct);

        return CreatedAtAction(nameof(GetOne), new { id = dto.Id }, dto);
    }

    // PATCH /api/files/{id}
    [HttpPatch("{id:int}")]
    public async Task<ActionResult<FileRecordDto>> Update(int id, [FromBody] UpdateFileRecordRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await _files.UpdateAsync(id, request, ct));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // DELETE /api/files/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var info = await _files.GetInstallInfoAsync(id, ct);
        if (info is null) return NotFound();

        // Best-effort delete from agent disk; ignore errors (agent may be offline)
        await _fileProxy.DeleteFileAsync(info.Value.Host, info.Value.FilePath, ct).ConfigureAwait(false);

        await _files.DeleteAsync(id, ct);
        return NoContent();
    }

    // POST /api/files/{id}/install — Install APK on one or more devices
    [HttpPost("{id:int}/install")]
    public async Task<IActionResult> Install(int id, [FromBody] InstallFileRequest request, CancellationToken ct)
    {
        var info = await _files.GetInstallInfoAsync(id, ct);
        if (info is null) return NotFound(new { error = "FileRecord not found or has no agent." });

        var result = await _fileProxy.InstallFileAsync(info.Value.Host, info.Value.FilePath, request.Udids, ct);
        return Ok(result);
    }
}

public record InstallFileRequest(string[] Udids);
