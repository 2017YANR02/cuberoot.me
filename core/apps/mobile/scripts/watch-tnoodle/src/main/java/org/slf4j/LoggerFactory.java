package org.slf4j;
public final class LoggerFactory {
    public static Logger getLogger(Class<?> type) { return org.slf4j.helpers.NOPLogger.NOP_LOGGER; }
    public static Logger getLogger(String name) { return org.slf4j.helpers.NOPLogger.NOP_LOGGER; }
}
