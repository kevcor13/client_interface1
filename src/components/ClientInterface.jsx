import React, { useState, useEffect } from 'react';
import './ClientInterface.css';

function ClientInterface() {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [userInfo, setUserInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    isScholarship: false,
  });
  const [bookingComplete, setBookingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Your backend base URL
  const BACKEND_URL = 'https://9507-140-209-96-104.ngrok-free.app';

  // Your Google Apps Script URL (if still sending emails from client)
  const googleScriptUrl =
    'https://script.google.com/macros/s/AKfycbxDd7vlYTXfnRCwdEziEF8zMwDdF5EshTcRMii_Lnv-hWH1AFqCLqU_5qgPFlHsNkNR5g/exec';

  // Helper: convert 24-hour time to 12-hour AM/PM format
  const formatTimeToStandard = (time) => {
    if (!time) return '';
    // If time already has AM/PM, just return it
    if (time.toUpperCase().includes('AM') || time.toUpperCase().includes('PM')) {
      return time;
    }
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const standardHour = hour % 12 || 12;
    return `${standardHour}:${minutes} ${ampm}`;
  };

  // Fetch available slots from your backend
  const fetchAvailableSlots = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/slots`);
      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }
      const data = await response.json();
      // Sort slots by date and time
      data.sort((a, b) => {
        const dateComparison = new Date(a.date) - new Date(b.date);
        if (dateComparison !== 0) return dateComparison;
        return a.time.localeCompare(b.time);
      });
      setAvailableSlots(data);
    } catch (error) {
      setErrorMessage('Error loading available slots: ' + error.message);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  // On mount, load slots and set up periodic refresh
  useEffect(() => {
    fetchAvailableSlots();
    const interval = setInterval(() => {
      fetchAvailableSlots(false);
    }, 30000);
    setRefreshInterval(interval);

    // Cleanup on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Group slots by date for display
  const groupSlotsByDate = () => {
    const grouped = {};
    availableSlots.forEach((slot) => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });
    return grouped;
  };

  // Helpers for displaying date info
  const getDayOfWeek = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getFormattedDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle slot selection
  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
  };

  // Optionally send emails from the client
  const sendEmails = async () => {
    const fullName = `${userInfo.firstName} ${userInfo.lastName}`;
    const dayOfWeek = getDayOfWeek(selectedSlot.date);
    const formattedDate = getFormattedDate(selectedSlot.date);
    const standardTime = formatTimeToStandard(selectedSlot.time);

    const date = new Date(selectedSlot.date);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();

    try {
      // 1. Owner notification
      await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'owner',
          slot_date: formattedDate,
          slot_time: standardTime,
          client_name: fullName,
          client_email: userInfo.email,
        }),
      });

      // 2. Scholarship email to client
      await fetch(googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scholarship',
          first_name: userInfo.firstName,
          to_email: userInfo.email,
          day_of_week: dayOfWeek,
          month: monthName,
          day,
          time: standardTime,
        }),
      });
      console.log('Emails sent successfully');
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return true;
    }
  };

  // Handle booking: call your backend to mark the slot as booked
  const handleBooking = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          clientName: `${userInfo.firstName} ${userInfo.lastName}`,
          clientEmail: userInfo.email,
          zoomOption: userInfo.isScholarship ? 'Yes' : 'No',
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to book appointment');
      }

      // Optionally send emails
      await sendEmails();

      // Clear refresh interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }

      setBookingComplete(true);
    } catch (error) {
      setErrorMessage('Error booking appointment: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading screen
  if (isLoading && !bookingComplete) {
    return (
      <div className="container loading-container">
        <div className="loading-wrapper">
          <div className="spinner"></div>
          <p className="loading-text">Loading available appointments...</p>
        </div>
      </div>
    );
  }

  // Booking confirmation screen
  if (bookingComplete) {
    return (
      <div className="container">
        <div className="confirmation-message">
          <div className="success-icon">
            <svg className="check-icon" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2>Booking Confirmed!</h2>
          <p>Thank you, {userInfo.firstName}!</p>
          <p>Your appointment has been scheduled for:</p>
          <div className="appointment-details">
            <p>
              <strong>{getDayOfWeek(selectedSlot.date)}</strong>,{' '}
              {new Date(selectedSlot.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p>
              <strong>Time:</strong> {formatTimeToStandard(selectedSlot.time)}
            </p>
          </div>
          <p>A confirmation email has been sent to {userInfo.email}.</p>
          <p>Please check your inbox (and spam folder) for all the details.</p>
          {userInfo.isScholarship && (
            <div className="scholarship-note">
              <p>
                <strong>Note:</strong> As a scholarship applicant, you've received specific
                instructions for your interview at Sitzmann Hall.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error screen
  if (errorMessage) {
    return (
      <div className="container error-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{errorMessage}</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      </div>
    );
  }

  // No available slots
  if (availableSlots.length === 0) {
    return (
      <div className="container no-slots-container">
        <div className="no-slots-message">
          <h2>No Available Appointments</h2>
          <p>Sorry, there are currently no available appointment slots.</p>
          <p>Please check back later or contact us directly to schedule.</p>
          <button onClick={() => fetchAvailableSlots()}>Refresh</button>
        </div>
      </div>
    );
  }

  // Main booking interface
  return (
    <div className="container">
      <div className="banner">
        <img src="/CatholicStudiesPurple.png" alt="Guadalupe's Scholar Logo" />
      </div>
      <h1 className="page-title">Guadalupe's Scholars Interview</h1>

      {!selectedSlot ? (
        <div className="slots-container">
          <p className="instructions">Select an available date and time below:</p>
          {Object.entries(groupSlotsByDate()).map(([date, slots]) => (
            <div key={date} className="date-group">
              <h2 className="date-header">
                <strong>{getDayOfWeek(date)}</strong>,{' '}
                {new Date(date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h2>
              <div className="time-slots">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    className="time-slot"
                    onClick={() => handleSelectSlot(slot)}
                  >
                    {formatTimeToStandard(slot.time)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="booking-form-container">
          <div className="selected-slot-info">
            <h3>Selected Appointment:</h3>
            <p>
              <strong>{getDayOfWeek(selectedSlot.date)}</strong>,{' '}
              {new Date(selectedSlot.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p>
              <strong>Time:</strong> {formatTimeToStandard(selectedSlot.time)}
            </p>
            <button className="change-slot-btn" onClick={() => setSelectedSlot(null)}>
              Change Selection
            </button>
          </div>

          <form className="booking-form" onSubmit={handleBooking}>
            <h3>Please Complete Your Booking</h3>
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                required
                value={userInfo.firstName}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, firstName: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                required
                value={userInfo.lastName}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, lastName: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                required
                value={userInfo.email}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, email: e.target.value })
                }
              />
            </div>

            <div className="form-group checkbox-group">
              <input
                type="checkbox"
                id="isScholarship"
                checked={userInfo.isScholarship}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, isScholarship: e.target.checked })
                }
              />
              <label htmlFor="isScholarship">
                Click here if you are a student more than 1 hour away from campus and
                would like to do zoom option
              </label>
            </div>

            <button type="submit" className="book-btn">
              Confirm Booking
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ClientInterface;
