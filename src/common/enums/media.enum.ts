export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
}

// Values match the Mongoose model names so they can drive a dynamic `refPath`.
export enum MediaOwnerType {
  CITY = 'City',
  TOURIST_SITE = 'TouristSite',
  GALLERY = 'Gallery',
  HISTORICAL_FIGURE = 'HistoricalFigure',
}
