// BadUX Date Picker - Deliberately confusing but functional!

// Month mapping - intentionally out of order for "bad UX"
// The keys are random numbers to make the dropdown options appear in a confusing order
// This is a deliberate design choice for the "badux.lol" competition
const monthMap = {
    '13': 'January',
    '7': 'February',
    '1': 'March',
    '11': 'April',
    '5': 'May',
    '9': 'June',
    '3': 'July',
    '8': 'August',
    '4': 'September',
    '10': 'October',
    '2': 'November',
    '6': 'December'
};

// Reverse mapping for getting actual month number
const reverseMonthMap = {
    'January': 1,
    'February': 2,
    'March': 3,
    'April': 4,
    'May': 5,
    'June': 6,
    'July': 7,
    'August': 8,
    'September': 9,
    'October': 10,
    'November': 11,
    'December': 12
};

let selectedYear = 2024;
let selectedMonth = null;
let selectedDay = null;

// Initialize the date picker
function init() {
    const yearSlider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-display');
    const monthDropdown = document.getElementById('month-dropdown');
    
    // Initialize selected month from dropdown's default value
    selectedMonth = monthMap[monthDropdown.value];
    
    // Year slider event
    yearSlider.addEventListener('input', function() {
        selectedYear = parseInt(this.value);
        yearDisplay.textContent = selectedYear;
        updateDayButtons();
        updateSelectedDate();
    });
    
    // Month dropdown event
    monthDropdown.addEventListener('change', function() {
        const monthName = monthMap[this.value];
        selectedMonth = monthName;
        updateDayButtons();
        updateSelectedDate();
    });
    
    // Initialize day buttons
    createDayButtons();
}

// Create all 31 day buttons (bad UX - some months don't have 31 days!)
function createDayButtons() {
    const dayButtonsContainer = document.getElementById('day-buttons');
    
    for (let i = 1; i <= 31; i++) {
        const button = document.createElement('button');
        button.className = 'day-button';
        button.textContent = i;
        button.setAttribute('data-day', i);
        
        button.addEventListener('click', function() {
            // Remove selected class from all buttons
            document.querySelectorAll('.day-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // Add selected class to clicked button
            this.classList.add('selected');
            selectedDay = parseInt(this.getAttribute('data-day'));
            updateSelectedDate();
        });
        
        dayButtonsContainer.appendChild(button);
    }
}

// Update day buttons based on selected month and year
function updateDayButtons() {
    const dayButtons = document.querySelectorAll('.day-button');
    
    if (!selectedMonth) {
        // Enable all buttons if no month selected
        dayButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        return;
    }
    
    // Get days in month
    const monthNum = reverseMonthMap[selectedMonth];
    const daysInMonth = new Date(selectedYear, monthNum, 0).getDate();
    
    // Disable invalid days
    dayButtons.forEach(btn => {
        const day = parseInt(btn.getAttribute('data-day'));
        if (day > daysInMonth) {
            btn.disabled = true;
            btn.style.opacity = '0.3';
            btn.classList.remove('selected');
            if (selectedDay === day) {
                selectedDay = null;
            }
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    });
}

// Update the displayed selected date
function updateSelectedDate() {
    const display = document.getElementById('selected-date');
    
    if (!selectedYear || !selectedMonth || !selectedDay) {
        display.textContent = 'No date selected yet';
        display.style.color = '#999';
        return;
    }
    
    // Check if the day is valid for the selected month
    const monthNum = reverseMonthMap[selectedMonth];
    const daysInMonth = new Date(selectedYear, monthNum, 0).getDate();
    
    if (selectedDay > daysInMonth) {
        display.textContent = `Invalid date! ${selectedMonth} ${selectedYear} only has ${daysInMonth} days`;
        display.style.color = '#e74c3c';
        return;
    }
    
    // Format the date
    const formattedDate = `${selectedMonth} ${selectedDay}, ${selectedYear}`;
    const isoDate = new Date(selectedYear, monthNum - 1, selectedDay);
    const isoString = isoDate.toISOString().split('T')[0];
    
    // Display both formats (replaced innerHTML with DOM manipulation to prevent XSS from user-controlled date values)
    display.textContent = '';  // Clear existing content
    const dateText = document.createTextNode(formattedDate);
    const lineBreak = document.createElement('br');
    const isoText = document.createTextNode(`(${isoString})`);
    display.appendChild(dateText);
    display.appendChild(lineBreak);
    display.appendChild(isoText);
    display.style.color = '#764ba2';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
