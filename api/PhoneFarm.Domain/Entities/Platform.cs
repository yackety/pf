namespace PhoneFarm.Domain.Entities;

public class Platform
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;

    public ICollection<Account> Accounts { get; set; } = [];
}
