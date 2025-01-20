'use client';
import { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import eventsData from './data.json';

interface Event {
  [key: string]: string | string[];
}

interface EventsByDate {
  [key: string]: Event;
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const [processedEventsData, setProcessedEventsData] = useState<{[key: string]: {[key: string]: string | string[]}}>({}); 

  // Add these helper functions
  const expandDateRange = (dateRange: string): string[] => {
    const [start, end] = dateRange.split('-').map(d => d.trim());
    const [startMonth, startDay, startYear] = start.split(' ');
    const [endMonth, endDay, endYear] = end ? end.split(' ') : [startMonth, startDay, startYear];
    
    const startDate = new Date(`${startMonth} ${startDay} ${startYear}`);
    const endDate = new Date(`${endMonth} ${endDay} ${endYear}`);
    
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(currentDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).toLowerCase());
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  // Add this new helper function to process all events by date
  const processEventsData = () => {
    const processedEvents: { [key: string]: { [key: string]: string | string[] } } = {};
    
    Object.entries(eventsData).forEach(([dateKey, events]) => {
      if (dateKey.includes('-')) {
        // Handle date range
        const expandedDates = expandDateRange(dateKey);
        expandedDates.forEach(date => {
          if (!processedEvents[date]) {
            processedEvents[date] = {};
          }
          // Add all events from this range to each date
          Object.entries(events).forEach(([event, details]) => {
            processedEvents[date][event] = details;
          });
        });
      } else {
        // Handle single date
        if (!processedEvents[dateKey]) {
          processedEvents[dateKey] = {};
        }
        Object.entries(events).forEach(([event, details]) => {
          processedEvents[dateKey][event] = details;
        });
      }
    });
    
    return processedEvents;
  };

  // Modified filter function to search across all dates when searching
  const getFilteredEvents = () => {
    if (!searchQuery || !isSearching) {
      return selectedDate ? Object.entries(processedEventsData[selectedDate] || {}) : [];
    }

    const allEvents: [string, string, string][] = [];
    Object.entries(processedEventsData).forEach(([date, events]) => {
      Object.entries(events).forEach(([event, details]) => {
        if (
          event.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (details as string).toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          allEvents.push([event, details as string, date]);
        }
      });
    });
    return allEvents;
  };

  const handleSearch = () => {
    setIsSearching(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  // Location mapping (you'll need to add more locations)
  const locationCoords: { [key: string]: {lat: number, lng: number} } = {
    "SM Seaside Cebu": { lat: 10.2791, lng: 123.8584 },
    "Fuente Osmeña": { lat: 10.3107, lng: 123.8925 },
    "Plaza Independencia": { lat: 10.2925, lng: 123.9054 },
    "Basilica del Sto. Nino": { lat: 10.2947, lng: 123.9021 },
    "SRP": { lat: 10.2673, lng: 123.8827 },
    // Add more locations as needed
  };

  const handleEventClick = (location: string | string[]) => {
    // Handle array case
    if (Array.isArray(location)) {
      location = location[0]; // Take the first location string from the array
    }

    const locationString = location.replace(/[\[\]]/g, '').split(', ');
    // Remove the time from the first element
    locationString.shift();
    
    // Rest of the function remains the same
    const locations = locationString
      .join(', ')
      .split(' & ')
      .map(loc => loc.trim());

    for (const loc of locations) {
      if (locationCoords[loc]) {
        setSelectedLocation(locationCoords[loc]);
        if (map) {
          map.panTo(locationCoords[loc]);
        }
        break;
      }
    }
  };

  const mapContainerStyle = {
    width: '100%',
    height: '100%'
  };

  const defaultCenter = {
    lat: 10.3157,
    lng: 123.8854
  };

  const hasValidLocation = (details: string | string[]) => {
    // Handle array case
    if (Array.isArray(details)) {
      details = details[0]; // Take the first location string from the array
    }

    const locationString = details.replace(/[\[\]]/g, '').split(', ');
    locationString.shift(); // Remove time
    
    const locations = locationString
      .join(', ')
      .split(' & ')
      .map(loc => loc.trim());

    return locations.some(loc => locationCoords[loc]);
  };

  // Add this helper function to safely parse location details
  const parseLocationDetails = (details: string | string[]) => {
    try {
      // If details is an array, take the first element
      const detailString = Array.isArray(details) ? details[0] : details;
      if (typeof detailString !== 'string') return { time: '', locations: [] };

      const parts = detailString.replace(/[\[\]]/g, '').split(', ');
      const time = parts[0];
      const locations = parts.slice(1).join(', ').split(' & ').map(loc => loc.trim());
      
      return { time, locations };
    } catch (error) {
      console.error('Error parsing location details:', error);
      return { time: '', locations: [] };
    }
  };

  // Add these new helper functions after the existing ones
  const formatEventDetails = (details: string | string[]) => {
    try {
      const detailString = Array.isArray(details) ? details[0] : details;
      if (typeof detailString !== 'string') return detailString;
      
      // Remove brackets and trim
      return detailString.replace(/[\[\]]/g, '').trim();
    } catch (error) {
      console.error('Error formatting event details:', error);
      return '';
    }
  };

  const addToCalendar = (event: string, details: string, date: string) => {
    try {
      const { time, locations } = parseLocationDetails(details);
      const eventDate = new Date(date);
      const [hours, minutes] = time.split(':');
      const isPM = time.includes('PM');
      
      eventDate.setHours(
        isPM ? parseInt(hours) + 12 : parseInt(hours),
        parseInt(minutes) || 0
      );
      
      const endDate = new Date(eventDate);
      endDate.setHours(endDate.getHours() + 2); // Assume 2-hour duration
      
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event)}&dates=${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&location=${encodeURIComponent(locations.join(', '))}&details=${encodeURIComponent(`Sinulog 2025 Event: ${event}`)}`;
      
      window.open(googleCalendarUrl, '_blank');
    } catch (error) {
      console.error('Error adding to calendar:', error);
    }
  };

  const openInMaps = (location: string) => {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    window.open(googleMapsUrl, '_blank');
  };

  // Update useEffect to use processed events
  useEffect(() => {
    const processed = processEventsData();
    setProcessedEventsData(processed);
    
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).toLowerCase();
    
    const allDates = Object.keys(processed).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );
    
    const todayOrNext = allDates.find(date => 
      new Date(date).setHours(0,0,0,0) >= today.setHours(0,0,0,0)
    ) || allDates[0];
    
    setSelectedDate(todayOrNext);

    // Center the selected date button
    setTimeout(() => {
      const selectedButton = document.querySelector(`[data-date="${todayOrNext}"]`);
      if (selectedButton && dateScrollRef.current) {
        const scrollContainer = dateScrollRef.current;
        const buttonRect = (selectedButton as HTMLElement).getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const scrollLeft = button.offsetLeft - (containerRect.width / 2) + (buttonRect.width / 2);
        scrollContainer.scrollLeft = scrollLeft;
      }
    }, 100);
  }, []);

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex-1 flex flex-row">
        {/* Events sidebar */}
        <div className="w-1/4 bg-orange-200 p-4 overflow-y-auto">
          <div className='text-4xl text-black'>Sinulog 2025</div>
          <div className='text-xl text-black'>Once Beat, One Dance, One Vision</div>
          
          {/* Search input with button */}
          <div className="mt-4 mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 p-2 rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400 text-black"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Search
              </button>
            </div>
            {isSearching && searchQuery && (
              <button
                onClick={clearSearch}
                className="mt-2 text-sm text-orange-700 hover:text-orange-900"
              >
                Clear Search
              </button>
            )}
          </div>

          {/* Date scroll - only show when not searching */}
          {!isSearching && (
            <div className="w-full bg-orange-300 p-4 rounded-xl">
              <div 
                ref={dateScrollRef}
                className="overflow-x-auto scrollbar-none"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  scrollBehavior: 'smooth'
                }}
              >
                <div className="flex flex-row gap-4 justify-start min-w-max px-4">
                  {Object.keys(processedEventsData)
                    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                    .map((date) => (
                      <button
                        key={date}
                        data-date={date}
                        onClick={() => {
                          setSelectedDate(date);
                          // Center this button when clicked
                          const button = document.querySelector(`[data-date="${date}"]`);
                          if (button && dateScrollRef.current) {
                            const scrollContainer = dateScrollRef.current;
                            const buttonRect = (button as HTMLElement).getBoundingClientRect();
                            const containerRect = scrollContainer.getBoundingClientRect();
                            const scrollLeft = button.offsetLeft - (containerRect.width / 2) + (buttonRect.width / 2);
                            scrollContainer.scrollTo({
                              left: scrollLeft,
                              behavior: 'smooth'
                            });
                          }
                        }}
                        className={`px-4 py-2 rounded whitespace-nowrap ${
                          selectedDate === date ? 'bg-orange-500 text-white' : 'hover:bg-orange-400'
                        }`}
                      >
                        {new Date(date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Events display */}
          {isSearching ? (
            <h2 className="text-xl font-bold mb-4 mt-8 text-black">
              Search Results
            </h2>
          ) : (
            selectedDate && (
              <h2 className="text-xl font-bold mb-4 mt-8 text-black">
                Events for {new Date(selectedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </h2>
            )
          )}

          {getFilteredEvents().map((eventData) => {
            const [event, details, date] = isSearching 
              ? eventData as [string, string, string]
              : [eventData[0], eventData[1], selectedDate];
            
            const { time, locations } = parseLocationDetails(details);
            const hasLocation = locations.some(loc => locationCoords[loc]);
            const formattedDetails = formatEventDetails(details);
            
            return (
              <div
                key={`${date}-${event}`}
                className="p-3 bg-white rounded-lg mb-3 hover:bg-orange-100 text-black transition-colors relative"
              >
                {isSearching && (
                  <div className="text-xs text-orange-600 mb-1">
                    {new Date(date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                )}
                <p className="font-medium">{event}</p>
                <p className="text-sm text-gray-600 mb-3">{formattedDetails}</p>
                
                <div className="flex gap-2 mt-2">
                  {hasLocation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openInMaps(locations[0]);
                      }}
                      className="text-xs px-3 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                    >
                      Open in Maps
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCalendar(event, details, date);
                    }}
                    className="text-xs px-3 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                  >
                    Add to Calendar
                  </button>
                </div>
                
                {!hasLocation && (
                  <span className="absolute top-2 right-2 text-yellow-500 text-xs" title="Location not mapped">
                    ⚠️ Not Found
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Map container */}
        <div className="flex-1">
          <LoadScript googleMapsApiKey="AIzaSyCa0ALxq4q2PDyFh0iWG1rYz4D5zmgl2K8">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={selectedLocation || defaultCenter}
              zoom={13}
              onLoad={map => setMap(map)}
            >
              {selectedLocation && (
                <Marker
                  position={selectedLocation}
                />
              )}
            </GoogleMap>
          </LoadScript>
        </div>
      </div>
    </div>
  );
}
