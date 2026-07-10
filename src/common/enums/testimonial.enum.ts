// The kind of entity a testimonial is about. Values match the Mongoose model
// names so they can drive a dynamic `refPath`.
export enum TestimonialSubjectType {
  CITY = 'City',
  TOURIST_SITE = 'TouristSite',
  HISTORICAL_FIGURE = 'HistoricalFigure',
}
