using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PhoneFarm.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMoreFileMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppName",
                table: "FileRecords",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Architectures",
                table: "FileRecords",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PermissionsCount",
                table: "FileRecords",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequiresAndroid",
                table: "FileRecords",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Signature",
                table: "FileRecords",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AppName",
                table: "FileRecords");

            migrationBuilder.DropColumn(
                name: "Architectures",
                table: "FileRecords");

            migrationBuilder.DropColumn(
                name: "PermissionsCount",
                table: "FileRecords");

            migrationBuilder.DropColumn(
                name: "RequiresAndroid",
                table: "FileRecords");

            migrationBuilder.DropColumn(
                name: "Signature",
                table: "FileRecords");
        }
    }
}
