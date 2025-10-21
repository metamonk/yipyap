# Testing Strategy

## Testing Pyramid

```
        E2E Tests (10%)
       /              \
    Integration (30%)
   /                  \
Frontend Unit (30%)  Backend Unit (30%)
```

## Test Organization

### Frontend Tests

```
tests/
├── unit/                    # Unit tests
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── services/
├── integration/             # Integration tests
│   ├── auth/
│   ├── messaging/
│   └── offline/
└── e2e/                    # End-to-end tests
    ├── auth.e2e.ts
    ├── messaging.e2e.ts
    └── groups.e2e.ts
```

### Backend Tests

```
firebase/functions/tests/
├── unit/                   # Unit tests
│   ├── messaging/
│   └── users/
├── integration/           # Integration tests
│   └── triggers/
└── rules/                 # Security rules tests
    ├── firestore.test.ts
    └── storage.test.ts
```

### E2E Tests

```
e2e/
├── flows/
│   ├── onboarding.e2e.ts
│   ├── conversation.e2e.ts
│   └── offline-sync.e2e.ts
└── config/
    └── detox.config.js
```

## Test Examples

### Frontend Component Test

```typescript
// tests/unit/components/MessageItem.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MessageItem } from '@/components/chat/MessageItem';

describe('MessageItem', () => {
  const mockMessage = {
    id: '1',
    text: 'Hello world',
    senderId: 'user1',
    status: 'delivered',
    timestamp: new Date()
  };

  it('renders message text correctly', () => {
    const { getByText } = render(
      <MessageItem message={mockMessage} isOwnMessage={false} />
    );

    expect(getByText('Hello world')).toBeTruthy();
  });

  it('shows correct status icon for delivered message', () => {
    const { getByTestId } = render(
      <MessageItem message={mockMessage} isOwnMessage={true} />
    );

    expect(getByTestId('status-delivered')).toBeTruthy();
  });
});
```

### Backend API Test

```typescript
// firebase/functions/tests/unit/messaging/sendNotification.test.ts
import * as admin from 'firebase-admin';
import { sendMessageNotification } from '@/messaging/sendNotification';

jest.mock('firebase-admin');

describe('sendMessageNotification', () => {
  it('sends notification to all recipients except sender', async () => {
    const mockMessage = {
      senderId: 'sender1',
      text: 'Test message',
      senderName: 'John',
    };

    const mockConversation = {
      participantIds: ['sender1', 'recipient1', 'recipient2'],
    };

    // Mock Firestore responses
    admin
      .firestore()
      .collection()
      .doc()
      .get.mockResolvedValue({
        data: () => mockConversation,
      });

    // Execute function
    await sendMessageNotification(mockMessage, { conversationId: 'conv1' });

    // Verify FCM was called correctly
    expect(admin.messaging().sendToDevice).toHaveBeenCalledWith(
      expect.arrayContaining(['token1', 'token2']),
      expect.objectContaining({
        notification: {
          title: 'John',
          body: 'Test message',
        },
      })
    );
  });
});
```

### E2E Test

```typescript
// e2e/flows/messaging.e2e.ts
describe('Messaging Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
    await loginAsTestUser();
  });

  it('should send and receive messages in real-time', async () => {
    // Navigate to conversation
    await element(by.id('conversation-1')).tap();

    // Type and send message
    await element(by.id('message-input')).typeText('Hello from E2E test');
    await element(by.id('send-button')).tap();

    // Verify message appears with sending status
    await expect(element(by.text('Hello from E2E test'))).toBeVisible();
    await expect(element(by.id('status-sending'))).toBeVisible();

    // Wait for delivery confirmation
    await waitFor(element(by.id('status-delivered')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify message persists after app restart
    await device.reloadReactNative();
    await expect(element(by.text('Hello from E2E test'))).toBeVisible();
  });
});
```

---
