using System.Net;
using System.Text.Json;

namespace PhoneFarm.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (UnauthorizedAccessException ex)
        {
            await WriteErrorAsync(context, HttpStatusCode.Unauthorized, ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            await WriteErrorAsync(context, HttpStatusCode.NotFound, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            await WriteErrorAsync(context, HttpStatusCode.Conflict, ex.Message);
        }
        catch (ArgumentException ex)
        {
            await WriteErrorAsync(context, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            await WriteErrorAsync(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
        }
    }

    private static Task WriteErrorAsync(HttpContext context, HttpStatusCode status, string message)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)status;
        var body = JsonSerializer.Serialize(new { error = message });
        return context.Response.WriteAsync(body);
    }
}
