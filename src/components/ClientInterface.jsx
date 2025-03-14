import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import './ClientInterface.css'; // Add this import for the CSS

function ClientInterface() {
  const { sheetId } = useParams();
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', email: '' });
  const [bookingComplete, setBookingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Load available slots on component mount and set up periodic refresh
  useEffect(() => {
    if (sheetId) {
      fetchAvailableSlots();
      
      // Set up a refresh interval to check for updates every 30 seconds
      const interval = setInterval(() => {
        fetchAvailableSlots(false); // Pass false to avoid showing loading indicator on refresh
      }, 30000);
      
      setRefreshInterval(interval);
      
      // Clean up interval on component unmount
      return () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      };
    } else {
      setIsLoading(false);
      setErrorMessage('No sheet ID provided. Please use the correct booking link.');
    }
  }, [sheetId]);

  // Fetch available slots from SheetDB
  const fetchAvailableSlots = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      const response = await fetch(`https://sheetdb.io/api/v1/${sheetId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }
      const data = await response.json();
      // Filter to only show slots with status "Available"
      const availableSlots = data.filter(slot => slot.status === 'Available');
      
      // Sort slots by date and time
      availableSlots.sort((a, b) => {
        // First compare dates
        const dateComparison = new Date(a.date) - new Date(b.date);
        if (dateComparison !== 0) return dateComparison;
        
        // If dates are the same, compare times
        return a.time.localeCompare(b.time);
      });
      
      setAvailableSlots(availableSlots);
    } catch (error) {
      setErrorMessage('Error loading available slots: ' + error.message);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  // Handle slot selection
  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
  };

  // Handle booking form submission
  const handleBooking = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // 1. Update slot status in SheetDB
      const response = await fetch(`https://sheetdb.io/api/v1/${sheetId}/id/${selectedSlot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: {
            status: 'Booked',
            client_name: `${userInfo.firstName} ${userInfo.lastName}`,
            client_email: userInfo.email,
            booking_date: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to book appointment');
      }

      // 2. Send notification emails using EmailJS
      await sendEmails();
      
      // Clear refresh interval when booking is complete
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

  // Send notification emails using EmailJS
  const sendEmails = async () => {
    try {
      // 1. Send email to the owner
      await emailjs.send(
        'service_qy1a7to',
        'template_rigyyhj',
        {
          slot_date: selectedSlot.date,
          slot_time: selectedSlot.time,
          client_name: `${userInfo.firstName} ${userInfo.lastName}`,
          client_email: userInfo.email,
          to_email:'kevincordero11.KC@gmail.com'
        },
        'n0fNHhb_WeOrB2Zw1'
      );
      
      // 2. Send confirmation email to the client
      await emailjs.send(
        'service_qy1a7to',
        'template_uj3y5pd',
        {
          slot_date: selectedSlot.date,
          slot_time: selectedSlot.time,
          client_name: userInfo.firstName,
          to_email: userInfo.email,
        },
        'n0fNHhb_WeOrB2Zw1'
      );
    } catch (error) {
      console.error('Email sending failed:', error);
      // We still consider the booking successful even if emails fail
    }
  };

  // Group slots by date
  const groupSlotsByDate = () => {
    const grouped = {};
    availableSlots.forEach(slot => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });
    return grouped;
  };

  // Show loading state
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
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="confirmation-title">Booking Confirmed!</h2>
          <p className="confirmation-details">Thank you, {userInfo.firstName}. You're scheduled for {selectedSlot.date} at {selectedSlot.time}.</p>
          <p className="confirmation-email">A confirmation email has been sent to {userInfo.email}.</p>
        </div>
      </div>
    );
  }

  // Regular booking interface
  return (
    <div className="container">
      <h1 className="page-title">Book Your Appointment</h1>
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
      
      {!selectedSlot ? (
        <div>
          <h2 className="section-title">Available Time Slots</h2>
          {availableSlots.length > 0 ? (
            <div className="slots-container">
              {Object.entries(groupSlotsByDate()).map(([date, slots]) => (
                <div key={date} className="date-group">
                  <h3 className="date-heading">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                  <div className="time-slots-grid">
                    {slots.map(slot => (
                      <button
                        key={slot.id}
                        className="time-slot-button"
                        onClick={() => handleSelectSlot(slot)}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-slots-message">No available time slots at the moment. Please check back later.</p>
          )}
        </div>
      ) : (
        <div>
          <div className="selected-slot-info">
            <p className="slot-details">Selected Time: {selectedSlot.date} at {selectedSlot.time}</p>
            <button 
              onClick={() => setSelectedSlot(null)} 
              className="change-selection-button"
            >
              Change selection
            </button>
          </div>
          
          <form onSubmit={handleBooking}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input 
                type="text" 
                className="form-input"
                value={userInfo.firstName}
                onChange={(e) => setUserInfo({...userInfo, firstName: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input 
                type="text" 
                className="form-input"
                value={userInfo.lastName}
                onChange={(e) => setUserInfo({...userInfo, lastName: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                className="form-input"
                value={userInfo.email}
                onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                required
              />
            </div>
            
            <button 
              type="submit"
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Confirm Booking'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ClientInterface;