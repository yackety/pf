namespace PhoneFarm.Application.Common;

public class PaginationQuery
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;

    public int Skip => (Page - 1) * PageSize;
}
