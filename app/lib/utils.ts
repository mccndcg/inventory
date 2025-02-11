import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function closePopover() {
  const escapeEvent = new KeyboardEvent('keydown', {
    key: 'Escape',        // The key value ('Escape')
    code: 'Escape',       // The physical key code
    keyCode: 27,          // Key code for 'Escape' (legacy)
    which: 27,            // Which code for 'Escape' (legacy)
    bubbles: true,        // Allows event propagation
    cancelable: true      // Allows event cancellation
  });

  // Dispatch the event on the document
  document.dispatchEvent(escapeEvent);
}


export function removeQuantities(inventory: PhysicalGood[], quantityToRemove: number) {
  // Sort the array by expirationDate, treating null as the latest date
  inventory.sort((a, b) => {
    if (a.expiration_date === null) return 1;
    if (b.expiration_date === null) return -1;
    return new Date(a.expiration_date) - new Date(b.expiration_date);
  });

  // Iterate through the inventory and deduct quantities
  for (let i = 0; i < inventory.length; i++) {
    if (quantityToRemove <= 0) break;

    const item = inventory[i];

    // Check if the item has any quantity
    if (item.quantity > 0) {
      if (item.quantity >= quantityToRemove) {
        // If the item quantity is enough, deduct from it
        item.quantity -= quantityToRemove;
        quantityToRemove = 0;
      } else {
        // If not enough, remove all and reduce quantityToRemove
        quantityToRemove -= item.quantity;
        item.quantity = 0;
      }
    }

    // Remove items with zero quantity
    if (item.quantity === 0) {
      inventory.splice(i, 1);
      i--; // Adjust the index to check the next item after removal
    }
  }

  return inventory;
}


export function groupByDate(array: DexieSales[]) {
  return array.reduce((acc: any, obj) => {
    // Convert the date string to a Date object if it's a string
    const date = new Date(obj.tx_date);

    // Extract year, month, and day
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    // Group by the dateKey
    if (!acc[dateKey]) {
      acc[dateKey] = [];  // Initialize the array for the date group if not exists
    }
    acc[dateKey].push(obj);  // Add the current object to the corresponding group

    return acc;
  }, {});
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);  // Parse the date string

  // Create an array of month names
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get the month, day, and year from the Date object
  const month = months[date.getMonth()];  // `getMonth()` returns 0-based index (0 = January)
  const day = date.getDate();             // `getDate()` returns the day of the month
  const year = date.getFullYear();        // `getFullYear()` returns the full 4-digit year

  // Return the formatted string
  return `${month} ${day}, ${year}`;
}

export function stringDateToNumberDate(dateString: string) {
  // Parse the date string
  const date = new Date(dateString);
  // Format the year, month, and day
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');

  // Combine into the desired format and convert to a number
  const formattedDate = `${year}${month}${day}`;
  const result = Number(formattedDate);
  return result
}

export function formatDateToNumber(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');  // Add 1 because months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');

  return Number(`${year}${month}${day}`);
}


export function getNamePrefix(name: string) {
  return name.slice(0, 6).toLowerCase();
}

interface GenericObject {
  [key: string]: any;
}

export function getChangedKeys(oldObj: GenericObject, newObj: GenericObject) {
  let result: GenericObject = {};

  // Loop through the keys of the new object
  for (let key in newObj) {
    // Check if the key exists in the old object and the values are different
    if (oldObj.hasOwnProperty(key)) {
      if (key == 'categories') {
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          result[key] = newObj[key]; // Add the key and its new value to the result object
        }
      }
      else if (oldObj[key] !== newObj[key]) {
        result[key] = newObj[key];
      }
    }
  }
  return result;
}

export function debounce(func: Function, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (...args: any[]) {
    // Clear the previous timer (if any) and set a new one
    if (timer) {
      clearTimeout(timer);
    }

    // Set a new timer that will call the function after the delay
    timer = setTimeout(() => {
      func(...args);
    }, delay);
  };
}


export function sortObjectByDate(obj: SalesObject, direction: boolean) {
  // Get the keys and sort them in ascending order
  const sortedKeys = Object.keys(obj).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return (dateA.getTime() - dateB.getTime()) * (direction ? 1 : -1); // Compare dates
  });

  // Create an array with the key and value, preserving the order
  return sortedKeys.map(key => ({
      date: key,      // include the key
      sales_arr: obj[key]  // include the value
  }));
}
