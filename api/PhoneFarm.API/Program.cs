using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PhoneFarm.Application.Accounts.Services;
using PhoneFarm.Application.Agents.Services;
using PhoneFarm.Application.Auth.Services;
using PhoneFarm.Application.Dashboard.Services;
using PhoneFarm.Application.Devices.Services;
using PhoneFarm.Application.Platforms.Services;
using PhoneFarm.Application.Users.Services;
using PhoneFarm.API.Hubs;
using PhoneFarm.API.Services;
using PhoneFarm.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// ── Database ────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<PhoneFarmDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// ── Application services ────────────────────────────────────────────────────
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAgentService, AgentService>();
builder.Services.AddScoped<IDeviceService, DeviceService>();
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<IPlatformService, PlatformService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAgentProxyService, AgentProxyService>();

// ── SignalR ─────────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── HttpClient (for agent proxy) ────────────────────────────────────────────
builder.Services.AddHttpClient("AgentProxy", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// ── Background services ─────────────────────────────────────────────────────
builder.Services.AddHostedService<HeartbeatMonitorService>();

// ── JWT Auth ────────────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero,
        };
        // SignalR passes the token via query string when WebSockets are used.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── CORS ────────────────────────────────────────────────────────────────────
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// ── Controllers + Swagger ───────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "PhoneFarm API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            []
        }
    });
});

// ── Build ───────────────────────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<PhoneFarm.API.Middleware.ExceptionMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<DeviceHub>("/hubs/devices");

app.Run();
