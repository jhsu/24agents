import * as React from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { cn } from "@/lib/utils"

interface Message {
    id: string
    text: string
    sender: "user" | "bot"
    timestamp: Date
}

export function ChatBox() {
    const [messages, setMessages] = React.useState<Message[]>([
        {
            id: "1",
            text: "Hello! How can I help you today?",
            sender: "bot",
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = React.useState("")

    const handleSend = () => {
        if (!input.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            sender: "user",
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput("")

        // Simulate bot response
        setTimeout(() => {
            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "This is a demo chat box. I'm just a placeholder for now!",
                sender: "bot",
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, botMessage])
        }, 1000)
    }

    return (
        <Card className="flex h-[500px] flex-col shadow-lg border-primary/20">
            <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Chat Assistant
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex items-end gap-2",
                            message.sender === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                    >
                        <Avatar className="size-8">
                            <AvatarFallback className={message.sender === "bot" ? "bg-primary text-primary-foreground text-xs" : "bg-muted text-xs"}>
                                {message.sender === "bot" ? "AI" : "ME"}
                            </AvatarFallback>
                        </Avatar>
                        <div
                            className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                message.sender === "user"
                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                    : "bg-muted text-foreground rounded-tl-none"
                            )}
                        >
                            {message.text}
                        </div>
                    </div>
                ))}
            </CardContent>
            <CardFooter className="border-t p-4 pt-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleSend()
                    }}
                    className="flex w-full items-center space-x-2"
                >
                    <Input
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="flex-1"
                    />
                    <Button type="submit" size="sm">
                        Send
                    </Button>
                </form>
            </CardFooter>
        </Card>
    )
}
