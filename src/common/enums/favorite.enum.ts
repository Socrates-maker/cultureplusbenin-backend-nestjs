// The kind of entity a user can bookmark. Values match the Mongoose model
// names so they can drive a dynamic `refPath`.
export enum FavoriteItemType {
  CITY = 'City',
  TOURIST_SITE = 'TouristSite',
  HISTORICAL_FIGURE = 'HistoricalFigure',
  STORY = 'Story',
  TRADITION = 'Tradition',
  EVENT = 'Event',
}
