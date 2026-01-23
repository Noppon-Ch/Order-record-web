function mockAction(actionName, customerName) {
    alert(`Action: ${actionName}\nCustomer: ${customerName}\n\n(This is a mockup feature)`);
}

async function deleteCustomer(customerId, customerName) {
    if (confirm(`Are you sure you want to delete ${customerName}? This action cannot be undone.`)) {
        try {
            const response = await fetch(`/customer/delete/${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                alert('Customer deleted successfully.');
                window.location.reload();
            } else {
                const data = await response.json();
                alert(`Failed to delete customer: ${data.error}`);
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            alert('An error occurred while deleting the customer.');
        }
    }
}
