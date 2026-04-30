namespace PhoneFarm.Application.Common;

public class PagedResult<T>
{
    public IReadOnlyList<T> Data { get; init; } = [];
    public int Total { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }

    public static PagedResult<T> From(IReadOnlyList<T> data, int total, int page, int pageSize) =>
        new() { Data = data, Total = total, Page = page, PageSize = pageSize };
}
