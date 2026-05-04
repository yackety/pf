Applies all pending migrations
```
cd d:\workspace\pf\api
dotnet ef database update --project PhoneFarm.Infrastructure --startup-project PhoneFarm.API
```
```
dotnet ef migrations add AddMoreFileMetadata --project PhoneFarm.Infrastructure --startup-project PhoneFarm.API --no-build
```