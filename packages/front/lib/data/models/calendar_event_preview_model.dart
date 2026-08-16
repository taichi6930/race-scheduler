import '../../domain/entities/calendar_event_preview.dart';
import '../../domain/entities/race_link.dart';

/// `GET /race/calendar-event` のレスポンスJSONをパースするモデル。
class CalendarEventPreviewModel {
  const CalendarEventPreviewModel({
    required this.summary,
    required this.description,
    required this.location,
    required this.startDateTime,
    required this.endDateTime,
    required this.links,
  });

  final String summary;
  final String description;
  final String location;
  final String startDateTime;
  final String endDateTime;
  final List<RaceLink> links;

  factory CalendarEventPreviewModel.fromJson(Map<String, dynamic> json) {
    final start = json['start'] as Map<String, dynamic>;
    final end = json['end'] as Map<String, dynamic>;
    final rawLinks = json['links'] as List<dynamic>? ?? [];
    return CalendarEventPreviewModel(
      summary: json['summary'] as String,
      description: json['description'] as String,
      location: json['location'] as String,
      startDateTime: start['dateTime'] as String,
      endDateTime: end['dateTime'] as String,
      links: [
        for (final rawLink in rawLinks)
          RaceLink(
            label: (rawLink as Map<String, dynamic>)['label'] as String,
            url: rawLink['url'] as String,
          ),
      ],
    );
  }

  CalendarEventPreview toEntity() {
    return CalendarEventPreview(
      summary: summary,
      description: description,
      location: location,
      startDateTime: startDateTime,
      endDateTime: endDateTime,
      links: links,
    );
  }
}
